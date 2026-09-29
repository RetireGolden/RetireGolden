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

import { parsePlan, type Plan, type Scenario } from '../model/plan.js'
import type { ParsePlanResult } from '../model/plan.js'
import type { MarketModelConfig } from '../montecarlo/marketModels.js'
import { createMarketModel } from '../montecarlo/marketModels.js'
import { aggregateMonteCarlo, runMonteCarloPaths } from '../montecarlo/run.js'
import { conversionFreeRun, summarizeProjection, type ProjectionSummary } from '../projection/compare.js'
import { simulatePlan, type SimulateOptions } from '../projection/simulate.js'
import type { TaxCalculator } from '../projection/types.js'
import {
  decodeScenarioPointer,
  isScenarioPatchEnvelope,
  parseScenarioPatch,
  type ScenarioOperation,
  type ScenarioPatchInput,
} from './contract.js'
import { applyScenarioPatchInput, canonicalScenarioJson, readScenarioValueState, scenarioChangesNothing } from './patch.js'
import { acaContractEditBetween, removeStaleAcaContracts } from '../model/acaContractRemovals.js'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function canonicalOperationSuppliesCompleteAcaEvidence(operation: ScenarioOperation): boolean {
  const evidencePath = '/expenses/healthcare/acaYears'
  if (operation.op !== 'set') return false
  if (operation.path === evidencePath) return true
  if (operation.path.startsWith(`${evidencePath}/`)) return false
  if (operation.path === '/expenses/healthcare') {
    return isPlainObject(operation.value) && Object.hasOwn(operation.value, 'acaYears')
  }
  if (operation.path === '/expenses') {
    return (
      isPlainObject(operation.value) &&
      isPlainObject(operation.value['healthcare']) &&
      Object.hasOwn(operation.value['healthcare'], 'acaYears')
    )
  }
  return false
}

/**
 * Whether a patch writes the premium-credit contracts itself: then it
 * supplies the evidence, and nothing it changes elsewhere removes any.
 */
function patchSuppliesAcaEvidence(patch: ScenarioPatchInput): boolean {
  if (isScenarioPatchEnvelope(patch)) {
    const parsed = parseScenarioPatch(patch)
    return parsed.ok && parsed.patch.operations.some(canonicalOperationSuppliesCompleteAcaEvidence)
  }
  if (!isPlainObject(patch)) return false
  const healthcare =
    isPlainObject(patch['expenses']) && isPlainObject(patch['expenses']['healthcare'])
      ? patch['expenses']['healthcare']
      : null
  return healthcare !== null && Object.hasOwn(healthcare, 'acaYears')
}

/**
 * Apply either a historical deep-merge patch or the canonical versioned
 * operation document. Legacy patches retain their original behavior; v1
 * documents add atomic precondition/conflict checks. Premium-credit contracts
 * the change leaves stale are removed and the removal is recorded
 * (model/acaContractRemovals.ts): a change to who is on the return (a person
 * added, removed or replaced, or the filing status) removes every contract; a
 * change to the rest of the household or to the pre-65 premium removes only
 * the stated ones, because a premium-field contract is derived from them on
 * every run (decision D-EXAMPLE-SOURCE-SWITCH, review finding M2). A patch
 * that writes the contracts itself removes nothing.
 */
export function applyScenarioPatch(plan: Plan, patch: ScenarioPatchInput): ParsePlanResult {
  const suppliesEvidence = patchSuppliesAcaEvidence(patch)
  const applied = applyScenarioPatchInput(plan, patch)
  if (!applied.ok || suppliesEvidence || applied.plan.expenses.healthcare.acaYears === undefined) {
    return applied
  }
  const edit = acaContractEditBetween(plan, applied.plan)
  if (edit === null) return applied
  const edited = structuredClone(applied.plan)
  if (!removeStaleAcaContracts(edited.expenses.healthcare, edit)) return applied
  return parsePlan(edited)
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
    return parsed.patch.operations.flatMap((operation) => {
      const current = readScenarioValueState(plan, operation.path)
      if (current === null) return []
      const scenarioValue = operation.op === 'set' ? operation.value : undefined
      const alreadyApplied =
        current.present === (operation.op === 'set') &&
        (!current.present || canonicalScenarioJson(current.value) === canonicalScenarioJson(scenarioValue))
      return alreadyApplied
        ? []
        : [
            {
              path: decodeScenarioPointer(operation.path)!.join('.'),
              baseValue: current.present ? current.value : undefined,
              scenarioValue,
            },
          ]
    })
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
  /**
   * True when the scenario applies and its plan is the base plan
   * (`scenarioChangesNothing`), so its figures are the baseline's; false for
   * the base row and for a scenario that does not apply. A host says so rather
   * than showing a copy of the baseline (decision D-SCENARIO-JSON-LOSS).
   */
  changesNothing: boolean
}

export interface ScenarioComparison {
  rows: ScenarioComparisonRow[]
}

function runOne(
  plan: Plan,
  opts: CompareScenariosOptions,
): { summary: ProjectionSummary; successRate: number | null } {
  const taxCalculator = opts.taxCalculatorForPlan ? opts.taxCalculatorForPlan(plan) : opts.taxCalculator
  const simulateOptions = { startYear: opts.startYear, taxCalculator }
  const summary = summarizeProjection(plan, simulatePlan(plan, simulateOptions), {
    conversionFreeRun: conversionFreeRun(plan, simulateOptions),
  })
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
  // A failed row prices nothing: null, as a plan in which nobody retires
  // publishes, never a $0 target (round-one review of #765, issues 7 and 12).
  fiNumber: null,
  fiYear: null,
  fiAge: null,
  coastFireNumber: null,
  fiBasis: { spendingYear: null, spendingSource: 'baseAnnual', personId: null, retirementYear: null, retirementRule: null, personLastYearAlive: null, notRetiring: [] },
}

/**
 * Run the base plan plus the given scenarios (default: all of plan.scenarios)
 * and produce one comparison row each. Scenario rows that fail validation get
 * an error string instead of metrics, so one bad patch never sinks the table.
 */
export function compareScenarios(plan: Plan, opts: CompareScenariosOptions, scenarios?: Scenario[]): ScenarioComparison {
  const rows: ScenarioComparisonRow[] = []
  const base = runOne(plan, opts)
  rows.push({ scenarioId: null, name: 'Base plan', summary: base.summary, error: null, diff: [], successRate: base.successRate, changesNothing: false })

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
        changesNothing: false,
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
      changesNothing: scenarioChangesNothing(plan, applied.plan),
    })
  }
  return { rows }
}
