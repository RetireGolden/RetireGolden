/**
 * Named scenarios: patch application, diffing, and side-by-side comparison
 * (roadmap V4, feature catalog §12).
 *
 * A scenario is a partial deep-override of the plan ("retire at 62", "17% SS
 * cut from 2034", "no Roth conversions"). Patches are stored loosely typed on
 * the plan (plan.scenarios[].patch); applying one deep-merges it over the
 * base plan and re-parses through the Zod schema, so an invalid override
 * fails loudly instead of simulating garbage.
 *
 * Merge rule: plain objects merge recursively; arrays, primitives, and null
 * replace wholesale. Replacing arrays keeps patches predictable (overriding
 * "accounts[1].balance" positionally would silently break when the user
 * reorders accounts).
 */

import type { Plan, Scenario } from '../model/plan.js'
import type { ParsePlanResult } from '../model/plan.js'
import type { MarketModelConfig } from '../montecarlo/marketModels.js'
import { createMarketModel } from '../montecarlo/marketModels.js'
import { aggregateMonteCarlo, runMonteCarloPaths } from '../montecarlo/run.js'
import { summarizeProjection, type ProjectionSummary } from '../projection/compare.js'
import { simulatePlan, type SimulateOptions } from '../projection/simulate.js'
import type { TaxCalculator } from '../projection/types.js'
import {
  decodeScenarioPointer,
  isScenarioPatchEnvelope,
  parseScenarioPatch,
  type ScenarioPatchInput,
} from './contract.js'
import { applyScenarioPatchInput } from './patch.js'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Apply either a historical deep-merge patch or the canonical versioned
 * operation document. Legacy patches retain their original behavior; v1
 * documents add atomic precondition/conflict checks.
 */
export function applyScenarioPatch(plan: Plan, patch: ScenarioPatchInput): ParsePlanResult {
  return applyScenarioPatchInput(plan, patch)
}

export interface ScenarioDiffEntry {
  /** Dotted path of the overridden leaf (e.g. "assumptions.ssHaircut.cutPct"). */
  path: string
  baseValue: unknown
  scenarioValue: unknown
}

/** Leaf-level diff of what a patch changes, for the comparison UI's "changed assumptions" panel. */
export function diffScenarioPatch(plan: Plan, patch: ScenarioPatchInput): ScenarioDiffEntry[] {
  if (isScenarioPatchEnvelope(patch)) {
    const parsed = parseScenarioPatch(patch)
    if (!parsed.ok) return []
    return parsed.patch.operations.map((operation) => ({
      path: decodeScenarioPointer(operation.path)!.join('.'),
      baseValue: operation.before.present ? operation.before.value : undefined,
      scenarioValue: operation.op === 'set' ? operation.value : undefined,
    }))
  }

  const entries: ScenarioDiffEntry[] = []
  const walk = (base: unknown, node: unknown, path: string) => {
    if (isPlainObject(node) && isPlainObject(base)) {
      for (const [key, value] of Object.entries(node)) {
        walk(base[key], value, path ? `${path}.${key}` : key)
      }
      return
    }
    if (JSON.stringify(base) !== JSON.stringify(node)) {
      entries.push({ path, baseValue: base, scenarioValue: node })
    }
  }
  walk(plan, patch, '')
  return entries
}

// ---------------------------------------------------------------------------
// Side-by-side comparison
// ---------------------------------------------------------------------------

export interface ScenarioMonteCarloOptions {
  model: MarketModelConfig
  pathCount: number
  seed: number
}

export interface CompareScenariosOptions extends SimulateOptions {
  /** When present, each scenario also gets a Monte Carlo success rate (same seed ⇒ same market paths). */
  monteCarlo?: ScenarioMonteCarloOptions
  /**
   * Build the tax stack from each row's own (patched) plan instead of pricing
   * every row with `taxCalculator`. Needed when a patch changes tax
   * assumptions (flat state-rate override, local rate) — e.g. relocation
   * scenarios — so the scenario reproduces the surface that created it.
   */
  taxCalculatorForPlan?: (plan: Plan) => TaxCalculator
}

export interface ScenarioComparisonRow {
  /** null for the base plan row. */
  scenarioId: string | null
  name: string
  summary: ProjectionSummary
  /** Patch-application or validation problems; when set, summary metrics are absent. */
  error: string | null
  diff: ScenarioDiffEntry[]
  successRate: number | null
}

export interface ScenarioComparison {
  rows: ScenarioComparisonRow[]
}

function runOne(
  plan: Plan,
  opts: CompareScenariosOptions,
): { summary: ProjectionSummary; successRate: number | null } {
  const taxCalculator = opts.taxCalculatorForPlan ? opts.taxCalculatorForPlan(plan) : opts.taxCalculator
  const summary = summarizeProjection(plan, simulatePlan(plan, { startYear: opts.startYear, taxCalculator }))
  let successRate: number | null = null
  if (opts.monteCarlo) {
    const result = runMonteCarloPaths(plan, {
      startYear: opts.startYear,
      taxCalculator,
      model: createMarketModel(opts.monteCarlo.model),
      seed: opts.monteCarlo.seed,
      pathCount: opts.monteCarlo.pathCount,
    })
    successRate = aggregateMonteCarlo(result).successRate
  }
  return { summary, successRate }
}

const EMPTY_SUMMARY: ProjectionSummary = {
  lifetimeTaxesAndPenalties: 0,
  lifetimeRothConversions: 0,
  endingInvestable: 0,
  endingNetWorth: 0,
  endingAfterTaxEstate: 0,
  endingEstateHeirTax: 0,
  endingEstateToCharity: 0,
  estateBreakdown: [],
  endingByCategory: { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0 },
  depletionYear: null,
  warnings: [],
  savingsRates: [],
  averagePreRetirementSavingsRatePct: 0,
  fiNumber: 0,
  fiYear: null,
  fiAge: null,
  coastFireNumber: 0,
}

/**
 * Run the base plan plus the given scenarios (default: all of plan.scenarios)
 * and produce one comparison row each. Scenario rows that fail validation get
 * an error string instead of metrics, so one bad patch never sinks the table.
 */
export function compareScenarios(plan: Plan, opts: CompareScenariosOptions, scenarios?: Scenario[]): ScenarioComparison {
  const rows: ScenarioComparisonRow[] = []
  const base = runOne(plan, opts)
  rows.push({ scenarioId: null, name: 'Base plan', summary: base.summary, error: null, diff: [], successRate: base.successRate })

  for (const scenario of scenarios ?? plan.scenarios) {
    const applied = applyScenarioPatch(plan, scenario.patch)
    if (!applied.ok) {
      rows.push({
        scenarioId: scenario.id,
        name: scenario.name,
        summary: EMPTY_SUMMARY,
        error: `Scenario overrides are invalid: ${applied.issues.join('; ')}`,
        diff: diffScenarioPatch(plan, scenario.patch),
        successRate: null,
      })
      continue
    }
    const run = runOne(applied.plan, opts)
    rows.push({
      scenarioId: scenario.id,
      name: scenario.name,
      summary: run.summary,
      error: null,
      diff: diffScenarioPatch(plan, scenario.patch),
      successRate: run.successRate,
    })
  }
  return { rows }
}
