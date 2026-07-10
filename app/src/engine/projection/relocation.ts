/**
 * Relocation compare ("where should I retire?" on your real plan) — see
 * DOCS/enhancements/state-relocation-compare.md.
 *
 * Runs the user's actual plan once per candidate state and ranks the results.
 * A candidate is expressed as a scenario patch over the existing split-year
 * state-move fields (no new persistence), so a candidate row is byte-identical
 * to manually editing the plan's state, and "Add as scenario" round-trips to
 * exactly what the sweep ran.
 *
 * Scope is income tax only: property tax, sales tax, cost of living, and
 * healthcare quality are out of the model. The optional local-rate and
 * flat-spending-delta knobs are the user's blunt approximations for those,
 * and both apply plan-wide (documented in the UI).
 */

import type { Plan } from '../model/plan'
import { stateForYear } from '../model/plan'
import { applyScenarioPatch } from '../scenarios/scenarios'
import { comparePlansOnSharedMarketPaths, type SharedPathPlan } from '../montecarlo/sharedPaths'
import type { MarketModelConfig } from '../montecarlo/marketModels'
import {
  stateParamsFor,
  type StateRetirementExclusion,
  type StateTaxParams,
} from '../params/state'
import { combineTaxCalculators, createFederalTaxCalculator } from '../tax/federalTax'
import { computeStateTaxYearTotal, createStateTaxCalculator } from '../tax/stateTax'
import { summarizeProjection } from './compare'
import { simulatePlan } from './simulate'
import type { TaxCalculator, TaxYearInput } from './types'

/** Hard cap on candidate states per sweep (each one is a full plan run + Monte Carlo). */
export const MAX_RELOCATION_CANDIDATES = 5

export interface RelocationCandidate {
  /** Two-letter destination state code. */
  state: string
  /**
   * Calendar year the move happens (July 1 by default, split-year taxed).
   * Omitted ⇒ the plan is priced as if already resident in the candidate
   * state from the start (the plan's base state is replaced).
   */
  moveYear?: number
  /** Move month for the split year (1–12); defaults to July like the planner. */
  moveMonth?: number
  /**
   * Flat local income-tax rate (percent) in the destination, replacing the
   * plan's `assumptions.localIncomeTaxPct`. Applies plan-wide — exact for a
   * from-the-start candidate, an approximation across a mid-plan move.
   * **Omitted means 0**: the destination's local rate starts clean, so the
   * origin's locality tax never silently follows the household. Pass the
   * plan's own rate explicitly to keep it.
   */
  localRatePct?: number
  /**
   * Flat cost-of-living knob: percent change applied to baseline lifestyle
   * spending (`expenses.baseAnnual`), e.g. -10 for a cheaper metro. Applies
   * plan-wide, not just after the move — a deliberate v1 simplification.
   */
  spendingDeltaPct?: number
}

/**
 * The scenario patch a candidate writes — only existing plan fields (household
 * state/moves, the flat-override/local-rate assumptions, baseline spending).
 * Applying it via `applyScenarioPatch` produces the exact plan the sweep runs,
 * so "Add as scenario" and the compare table can never disagree.
 *
 * When the plan's flat state-rate override is set (> 0) it would mask modeled
 * per-state packs entirely, so candidate patches clear it (the UI calls the
 * masking out).
 */
export function relocationScenarioPatch(
  plan: Plan,
  candidate: RelocationCandidate,
  startYear: number,
): Record<string, unknown> {
  const state = candidate.state.toUpperCase()
  const patch: Record<string, unknown> = {}
  if (candidate.moveYear !== undefined && candidate.moveYear >= startYear) {
    // Future (or current-year) move: keep the base state, replace any planned
    // moves with this one split-year move. Arrays replace wholesale in
    // scenario patches, so prior stateMoves cannot leak through.
    patch.household = {
      stateMoves: [{ fromYear: candidate.moveYear, fromMonth: candidate.moveMonth ?? 7, state }],
    }
  } else {
    // Resident from the start: swap the base state and drop planned moves.
    patch.household = { state, stateMoves: [] }
  }
  const assumptions: Record<string, unknown> = {}
  if (plan.assumptions.stateEffectiveTaxPct > 0) assumptions.stateEffectiveTaxPct = 0
  // Destination local rate starts clean unless specified (omitted = 0); only
  // written when it actually changes the plan, to keep scenario diffs tidy.
  const localRatePct = Math.max(0, candidate.localRatePct ?? 0)
  if (localRatePct !== plan.assumptions.localIncomeTaxPct) assumptions.localIncomeTaxPct = localRatePct
  if (Object.keys(assumptions).length > 0) patch.assumptions = assumptions
  if (candidate.spendingDeltaPct !== undefined && candidate.spendingDeltaPct !== 0) {
    patch.expenses = {
      baseAnnual: Math.max(0, Math.round(plan.expenses.baseAnnual * (1 + candidate.spendingDeltaPct / 100))),
    }
  }
  return patch
}

/** Facts about a state's big levers, straight from the modeled pack. */
export interface RelocationDriverFacts {
  state: string
  stateName: string
  hasIncomeTax: boolean
  taxesSocialSecurity: boolean
  retirementPrivate: StateRetirementExclusion
  retirementPublic: StateRetirementExclusion
  /** One shared all-retirement rule (no separate public-pension law). */
  retirementRuleShared: boolean
  capitalGainsAsOrdinary: boolean
  /** Percent of net capital gain in the state base. */
  capitalGainsTaxablePct: number
  capitalLossCarryforwardConformity: 'federal' | 'currentYearOnly'
  /** Top marginal bracket rate (married filing jointly), percent. */
  topRatePct: number
}

/**
 * Lifetime driver attribution for one row's destination state, computed by
 * re-pricing every recorded ledger tax year with one state feature
 * neutralized at a time (the identical code path the ledger used, so the
 * unmodified recomputation reconciles with the ledger's state-tax lines
 * exactly). Each "savings" is the extra lifetime state+local tax the plan
 * would have paid without that feature — 0 when the feature doesn't apply.
 */
export interface RelocationDrivers {
  /** Pack facts for the destination state; null when unmodeled or a flat override priced the row. */
  facts: RelocationDriverFacts | null
  /** Lifetime state+local tax the ledger actually charged (sum of the per-year lines). */
  totalStateLocalTax: number
  /** Saved because the state leaves the federally-taxable part of Social Security out of its base. */
  ssTreatmentSavings: number
  /** Saved by the state's retirement-income exclusion(s), both buckets together. */
  retirementExclusionSavings: number
  /** Portion attributable to a separate public-pension law; 0 when the state has one shared rule. */
  publicPensionExclusionSavings: number
  /** Saved vs a benchmark state that taxes 100% of net gains as ordinary income (can be negative for nonconforming states). */
  capitalGainsTreatmentSavings: number
}

export interface RelocationCandidateRow {
  /** 'baseline' for the stay-put row, else 'candidate-N'. */
  id: string
  label: string
  /** null for the baseline row. */
  candidate: RelocationCandidate | null
  /** Patch-application/validation failure; when set, all metrics are absent. */
  error: string | null
  /** Destination state that drives the drill-down (final residence state for the baseline). */
  destinationState: string
  /** False when any residence state in the row has no modeled pack (tax treated as $0) or a flat override priced it. */
  modeled: boolean
  lifetimeStateLocalTax: number
  lifetimeTaxesAndPenalties: number
  endingAfterTaxEstate: number
  endingNetWorth: number
  depletionYear: number | null
  endYear: number
  /** Monte Carlo success on shared market paths; null when the sweep ran deterministic-only. */
  successRate: number | null
  drivers: RelocationDrivers | null
  /** The ledger's per-year state+local tax lines (nominal). */
  stateTaxByYear: Array<{ year: number; tax: number }>
  warnings: string[]
}

export interface RelocationComparison {
  startYear: number
  /** Baseline first, then candidates in input order (the UI ranks). */
  rows: RelocationCandidateRow[]
  monteCarlo: { pathCount: number; seed: number } | null
}

export interface RelocationCompareOptions {
  startYear: number
  /** When present, each row also gets a success rate on shared market paths. */
  monteCarlo?: { model: MarketModelConfig; pathCount: number; seed: number } | null
}

interface RecordedYear {
  input: TaxYearInput
  tax: number
}

/** The app-standard per-plan tax stack, with the state side recorded per year. */
function recordingTaxStack(plan: Plan): { taxCalculator: TaxCalculator; lines: Map<number, RecordedYear> } {
  const lines = new Map<number, RecordedYear>()
  const stateCalculator = createStateTaxCalculator({
    overridePct: plan.assumptions.stateEffectiveTaxPct,
    localPct: plan.assumptions.localIncomeTaxPct,
  })
  const recordingState: TaxCalculator = {
    compute(input) {
      const tax = stateCalculator.compute(input)
      // The ledger converges tax iteratively within each year and never
      // revisits a finished year, so the last computation per year is the
      // ledger's final state-tax line.
      lines.set(input.year, { input, tax })
      return tax
    },
  }
  return { taxCalculator: combineTaxCalculators(createFederalTaxCalculator(), recordingState), lines }
}

function taxStackFor(plan: Plan): TaxCalculator {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}

function driverFacts(state: string, year: number): RelocationDriverFacts | null {
  const params = stateParamsFor(state, year)
  if (!params) return null
  const brackets = params.brackets.marriedFilingJointly
  return {
    state: params.code,
    stateName: params.name,
    hasIncomeTax: params.hasIncomeTax,
    taxesSocialSecurity: params.taxesSocialSecurity,
    retirementPrivate: params.retirementPrivate,
    retirementPublic: params.retirementPublic,
    retirementRuleShared: params.retirementRuleShared ?? false,
    capitalGainsAsOrdinary: params.capitalGainsAsOrdinary,
    capitalGainsTaxablePct: params.capitalGainsTaxablePct ?? (params.capitalGainsAsOrdinary ? 100 : 0),
    capitalLossCarryforwardConformity: params.capitalLossCarryforwardConformity ?? 'federal',
    topRatePct: brackets.length > 0 ? Math.max(...brackets.map((b) => b.ratePct)) : 0,
  }
}

/** Apply `map` to the destination state's params only, leaving other residence states untouched. */
function forState(state: string, map: (p: StateTaxParams) => StateTaxParams) {
  return (p: StateTaxParams) => (p.code === state ? map(p) : p)
}

function computeDrivers(
  plan: Plan,
  destinationState: string,
  startYear: number,
  lines: Map<number, RecordedYear>,
  warnings: string[],
): RelocationDrivers {
  const opts = { overridePct: plan.assumptions.stateEffectiveTaxPct, localPct: plan.assumptions.localIncomeTaxPct }
  let total = 0
  for (const { tax } of lines.values()) total += tax

  // A flat override masks modeled packs; drivers can't be attributed.
  if (plan.assumptions.stateEffectiveTaxPct > 0) {
    return {
      facts: null,
      totalStateLocalTax: total,
      ssTreatmentSavings: 0,
      retirementExclusionSavings: 0,
      publicPensionExclusionSavings: 0,
      capitalGainsTreatmentSavings: 0,
    }
  }

  const facts = driverFacts(destinationState, startYear)
  const sumVariant = (map: ((p: StateTaxParams) => StateTaxParams) | undefined): number => {
    let sum = 0
    for (const { input } of lines.values()) {
      sum += computeStateTaxYearTotal(input, map ? { ...opts, mapParams: forState(destinationState, map) } : opts)
    }
    return sum
  }

  // Acceptance guard: re-pricing every recorded year unmodified must equal the
  // ledger's state-tax lines — the drivers below are only meaningful if it does.
  const reconciled = sumVariant(undefined)
  if (Math.abs(reconciled - total) > 0.01) {
    warnings.push(
      'Driver attribution could not reconcile with the ledger state-tax lines; drill-down figures were suppressed.',
    )
    // facts: null keeps the UI on its "attribution unavailable" message
    // instead of rendering a drivers table of misleading $0 rows.
    return {
      facts: null,
      totalStateLocalTax: total,
      ssTreatmentSavings: 0,
      retirementExclusionSavings: 0,
      publicPensionExclusionSavings: 0,
      capitalGainsTreatmentSavings: 0,
    }
  }

  if (!facts) {
    return {
      facts: null,
      totalStateLocalTax: total,
      ssTreatmentSavings: 0,
      retirementExclusionSavings: 0,
      publicPensionExclusionSavings: 0,
      capitalGainsTreatmentSavings: 0,
    }
  }

  const noExclusion: StateRetirementExclusion = { kind: 'none' }
  // "Savings" = tax with the feature neutralized − tax as modeled.
  const ssTreatmentSavings = facts.taxesSocialSecurity
    ? 0
    : sumVariant((p) => ({ ...p, taxesSocialSecurity: true })) - total
  const retirementExclusionSavings =
    sumVariant((p) => ({ ...p, retirementPrivate: noExclusion, retirementPublic: noExclusion })) - total
  const publicPensionExclusionSavings = facts.retirementRuleShared
    ? 0
    : sumVariant((p) => ({ ...p, retirementPublic: noExclusion })) - total
  const capitalGainsTreatmentSavings =
    sumVariant((p) => ({
      ...p,
      capitalGainsAsOrdinary: true,
      capitalGainsTaxablePct: 100,
      capitalLossCarryforwardConformity: 'federal',
    })) - total

  return {
    facts,
    totalStateLocalTax: total,
    ssTreatmentSavings,
    retirementExclusionSavings,
    publicPensionExclusionSavings,
    capitalGainsTreatmentSavings,
  }
}

function candidateLabel(candidate: RelocationCandidate): string {
  const state = candidate.state.toUpperCase()
  return candidate.moveYear !== undefined ? `${state} (move ${candidate.moveYear})` : state
}

function runRow(
  id: string,
  label: string,
  candidate: RelocationCandidate | null,
  plan: Plan,
  startYear: number,
): { row: RelocationCandidateRow; plan: Plan | null } {
  const endYearFallback = startYear
  if (candidate) {
    const applied = applyScenarioPatch(plan, relocationScenarioPatch(plan, candidate, startYear))
    if (!applied.ok) {
      return {
        row: {
          id,
          label,
          candidate,
          error: `Candidate is invalid: ${applied.issues.join('; ')}`,
          destinationState: candidate.state.toUpperCase(),
          modeled: false,
          lifetimeStateLocalTax: 0,
          lifetimeTaxesAndPenalties: 0,
          endingAfterTaxEstate: 0,
          endingNetWorth: 0,
          depletionYear: null,
          endYear: endYearFallback,
          successRate: null,
          drivers: null,
          stateTaxByYear: [],
          warnings: [],
        },
        plan: null,
      }
    }
    plan = applied.plan
  }

  const { taxCalculator, lines } = recordingTaxStack(plan)
  const result = simulatePlan(plan, { startYear, taxCalculator })
  const summary = summarizeProjection(plan, result)

  // The state the drill-down attributes: the plan's ACTUAL final residence.
  // For a candidate whose move year falls beyond the horizon the ledger never
  // relocates, so labeling the requested state would misattribute a baseline
  // run — attribute the real residence and say so.
  const destinationState = stateForYear(plan.household, result.endYear)
  const warnings: string[] = []
  if (candidate && destinationState !== candidate.state.toUpperCase()) {
    warnings.push(
      `The planned move to ${candidate.state.toUpperCase()}${candidate.moveYear !== undefined ? ` in ${candidate.moveYear}` : ''} falls after the plan horizon (${result.endYear}), so this row never becomes a ${candidate.state.toUpperCase()} resident — it prices the unmoved plan.`,
    )
  }
  const drivers = computeDrivers(plan, destinationState, startYear, lines, warnings)

  // Modeled = every residence year priced through a modeled pack (or a flat
  // override deliberately in charge). An unmodeled state contributes $0 and
  // the ledger already warns about it; surface that as modeled:false.
  const overrideActive = plan.assumptions.stateEffectiveTaxPct > 0
  let allModeled = true
  if (!overrideActive) {
    for (const y of result.years) {
      if (!stateParamsFor(stateForYear(plan.household, y.year), y.year)) {
        allModeled = false
        break
      }
    }
  }

  const stateTaxByYear = [...lines.entries()]
    .filter(([year]) => year >= result.startYear && year <= result.endYear)
    .sort((a, b) => a[0] - b[0])
    .map(([year, { tax }]) => ({ year, tax }))

  return {
    row: {
      id,
      label,
      candidate,
      error: null,
      destinationState,
      modeled: allModeled && !overrideActive,
      lifetimeStateLocalTax: drivers.totalStateLocalTax,
      lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
      endingAfterTaxEstate: summary.endingAfterTaxEstate,
      endingNetWorth: summary.endingNetWorth,
      depletionYear: result.depletionYear,
      endYear: result.endYear,
      successRate: null,
      drivers,
      stateTaxByYear,
      warnings: [...warnings, ...result.warnings],
    },
    plan,
  }
}

/**
 * Deterministic N-state sweep (plus optional shared-path Monte Carlo).
 * Pure and synchronous — run it in a worker for the UI. Reproducible per
 * (plan, candidates, startYear, monteCarlo config).
 */
export function compareRelocationCandidates(
  plan: Plan,
  candidates: RelocationCandidate[],
  opts: RelocationCompareOptions,
): RelocationComparison {
  const capped = candidates.slice(0, MAX_RELOCATION_CANDIDATES)
  // The baseline label names the plan's own residency path, including any
  // planned moves ("CA → FL"), so "stay" never misdescribes a moving plan.
  const finalState = stateForYear(plan.household, Number.MAX_SAFE_INTEGER)
  const baselineLabel =
    finalState === plan.household.state
      ? `Stay in ${plan.household.state}`
      : `Your plan (${plan.household.state} → ${finalState})`
  const runs: Array<{ row: RelocationCandidateRow; plan: Plan | null }> = [
    runRow('baseline', baselineLabel, null, plan, opts.startYear),
    ...capped.map((candidate, i) =>
      runRow(`candidate-${i}`, candidateLabel(candidate), candidate, plan, opts.startYear),
    ),
  ]

  const mc = opts.monteCarlo ?? null
  if (mc) {
    const entries: SharedPathPlan[] = runs
      .filter((r): r is { row: RelocationCandidateRow; plan: Plan } => r.plan !== null)
      .map((r) => ({ id: r.row.id, label: r.row.label, plan: r.plan, taxCalculator: taxStackFor(r.plan) }))
    const comparison = comparePlansOnSharedMarketPaths(entries, {
      startYear: opts.startYear,
      // Unused fallback — every entry carries its own per-candidate stack.
      taxCalculator: taxStackFor(plan),
      model: mc.model,
      pathCount: mc.pathCount,
      seed: mc.seed,
    })
    const byId = new Map(comparison.rows.map((row) => [row.id, row.summary.successRate]))
    for (const r of runs) {
      const successRate = byId.get(r.row.id)
      if (successRate !== undefined) r.row.successRate = successRate
    }
  }

  return {
    startYear: opts.startYear,
    rows: runs.map((r) => r.row),
    monteCarlo: mc ? { pathCount: mc.pathCount, seed: mc.seed } : null,
  }
}
