/**
 * Monte Carlo path runner + aggregation (roadmap V4, feature catalog §11).
 *
 * Each path is the same deterministic annual ledger (engine/projection)
 * driven by one stochastic MarketSeries — never a separate model. Per-path
 * seeds derive from (seed, pathIndex), so a run is reproducible regardless
 * of how paths are partitioned across workers. Aggregation produces the
 * headline outputs: success probability, the per-year percentile fan,
 * the ending-balance distribution, and the depletion-age histogram.
 */

import type { Plan } from '../model/plan.js'
import { summarizeProjection } from '../projection/compare.js'
import { simulatePlan } from '../projection/simulate.js'
import type { TaxCalculator } from '../projection/types.js'
import type { LtcShockParams } from './ltcShock.js'
import { sampleCareEvents } from './ltcShock.js'
import type { MarketModel } from './marketModels.js'
import { MAX_AGE, sampleDeathAge } from './mortality.js'
import { createRng, derivePathSeed } from './rng.js'

export interface MonteCarloPathOptions {
  startYear: number
  taxCalculator: TaxCalculator
  model: MarketModel
  seed: number
  /** Number of paths this call runs. */
  pathCount: number
  /** Global index of the first path (worker partitioning); default 0. */
  firstPathIndex?: number
  /** Sample each person's lifespan from the mortality table per path (roadmap V6). */
  stochasticLongevity?: boolean
  /** Inject a probabilistic LTC care episode per path (roadmap V6); null = off. */
  ltcShock?: LtcShockParams | null
  /** Called after each completed path (drives progress UI). */
  onPathDone?: (completed: number) => void
}

/** Dollar threshold below which a shortfall is treated as rounding, not a miss. */
const SHORTFALL_EPSILON = 0.5

/** One path, reduced to what aggregation needs (full ledgers stay worker-local). */
export interface MonteCarloPath {
  /** End-of-year investable balance per projection year. */
  investableByYear: Float64Array
  endingInvestable: number
  endingNetWorth: number
  endingAfterTaxEstate: number
  depletionYear: number | null
  /** Sum of unfunded spending across the path. */
  totalShortfall: number
  /** Sum of unfunded required-floor dollars across the path. */
  totalRequiredShortfall: number
  /** Sum of missed target-lifestyle dollars across the path. */
  totalTargetShortfall: number
  /**
   * No year left the required spending floor unfunded (planning-depth roadmap
   * §4). Distinct from `depletionYear`: a guardrail plan can deliberately cut
   * discretionary spending yet still fund every essential.
   */
  requiredFloorMet: boolean
  /** No year missed target-lifestyle spending (a superset failure of the floor). */
  targetLifestyleMet: boolean
  /** Share of target spending funded across the path. */
  targetAttainmentPct: number
  /** Average annual target shortfall across the path. */
  averageAnnualTargetShortfall: number
  /** Number of years with any target shortfall. */
  yearsBelowTarget: number
  idealIntended: number
  idealFunded: number
  excessIntended: number
  excessFunded: number
  flexibleGoals: { funded: number; partiallyFunded: number; deferred: number; skipped: number; fundedAmount: number; unfundedAmount: number }
  guardrailActionCounts: { cut: number; raise: number; hold: number }
  /** Years this path spent with the discretionary layer cut below full (guardrail plans only). */
  guardrailCutYears: number
  /** Longest consecutive run of cut years on this path. */
  longestGuardrailCutSpellYears: number
  /** Deepest cut reached on this path, as a fraction of the discretionary layer (0..1). */
  maxGuardrailCutDepth: number
  /** Ending after-tax estate cleared the plan's bequest target (today's $, inflated to path end); null = no target set. */
  endingAboveBequestTarget: boolean | null
}

export interface MonteCarloPathsResult {
  startYear: number
  endYear: number
  paths: MonteCarloPath[]
}

export function runMonteCarloPaths(plan: Plan, opts: MonteCarloPathOptions): MonteCarloPathsResult {
  const first = opts.firstPathIndex ?? 0
  const paths: MonteCarloPath[] = []
  let startYear = opts.startYear
  let endYear = opts.startYear
  // In stochastic-longevity mode, run every path to a fixed wide horizon (the
  // youngest person reaching the table's max age) so the year grids align even
  // though sampled death ages differ; otherwise the horizon is plan-determined.
  const horizonEndYear = opts.stochasticLongevity
    ? Math.max(...plan.household.people.map((p) => Number(p.dob.slice(0, 4)) + MAX_AGE))
    : undefined
  for (let i = 0; i < opts.pathCount; i++) {
    const rng = createRng(derivePathSeed(opts.seed, first + i))
    // 120 years comfortably covers any plan horizon; simulate clamps reads.
    const market = opts.model.generatePath(rng, 120)
    let pathPlan = plan
    let deathAgeByPersonId: Record<string, number> | undefined
    if (opts.stochasticLongevity) {
      deathAgeByPersonId = {}
      for (const p of plan.household.people) {
        deathAgeByPersonId[p.id] = sampleDeathAge(rng, opts.startYear - Number(p.dob.slice(0, 4)), p.sex)
      }
    }
    if (opts.ltcShock) {
      const sampled = sampleCareEvents(rng, plan.household.people, opts.startYear, opts.ltcShock)
      if (sampled.length > 0) pathPlan = { ...plan, careEvents: [...plan.careEvents, ...sampled] }
    }
    const result = simulatePlan(pathPlan, {
      startYear: opts.startYear,
      taxCalculator: opts.taxCalculator,
      market,
      deathAgeByPersonId,
      horizonEndYear,
    })
    const projectionSummary = summarizeProjection(pathPlan, result)
    startYear = result.startYear
    endYear = result.endYear
    const investableByYear = new Float64Array(result.years.length)
    let requiredFloorMet = true
    let targetLifestyleMet = true
    let totalShortfall = 0
    let totalRequiredShortfall = 0
    let totalTargetShortfall = 0
    let targetIntended = 0
    let targetFunded = 0
    let targetShortfallTotal = 0
    let yearsBelowTarget = 0
    let idealIntended = 0
    let idealFunded = 0
    let excessIntended = 0
    let excessFunded = 0
    const flexibleGoals = { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 }
    const guardrailActionCounts = { cut: 0, raise: 0, hold: 0 }
    let guardrailCutYears = 0
    let longestGuardrailCutSpellYears = 0
    let currentCutSpellYears = 0
    let maxGuardrailCutDepth = 0
    for (let y = 0; y < result.years.length; y++) {
      const yr = result.years[y]!
      investableByYear[y] = yr.investableTotal
      const guardrailFactor = yr.expenses.guardrailFactor
      if (guardrailFactor < 1 - 1e-9) {
        guardrailCutYears++
        currentCutSpellYears++
        if (currentCutSpellYears > longestGuardrailCutSpellYears) longestGuardrailCutSpellYears = currentCutSpellYears
        if (1 - guardrailFactor > maxGuardrailCutDepth) maxGuardrailCutDepth = 1 - guardrailFactor
      } else {
        currentCutSpellYears = 0
      }
      totalShortfall += yr.shortfall
      totalRequiredShortfall += yr.requiredShortfall
      totalTargetShortfall += yr.targetShortfall
      if (yr.requiredShortfall > SHORTFALL_EPSILON) requiredFloorMet = false
      if (yr.targetShortfall > SHORTFALL_EPSILON) targetLifestyleMet = false
      targetIntended += yr.expenses.targetSpending
      targetFunded += Math.max(0, yr.expenses.targetSpending - yr.targetShortfall)
      targetShortfallTotal += yr.targetShortfall
      if (yr.targetShortfall > SHORTFALL_EPSILON) yearsBelowTarget++
      idealIntended += yr.expenses.idealSpending
      idealFunded += Math.max(0, yr.expenses.idealSpending - yr.idealShortfall)
      excessIntended += yr.expenses.excessSpending
      excessFunded += Math.max(0, yr.expenses.excessSpending - yr.excessShortfall)
      flexibleGoals.funded += yr.flexibleGoals.funded
      flexibleGoals.partiallyFunded += yr.flexibleGoals.partiallyFunded
      flexibleGoals.deferred += yr.flexibleGoals.deferred
      flexibleGoals.skipped += yr.flexibleGoals.skipped
      flexibleGoals.fundedAmount += yr.flexibleGoals.fundedAmount
      flexibleGoals.unfundedAmount += yr.flexibleGoals.unfundedAmount
      guardrailActionCounts[yr.guardrailAction]++
    }
    // Bequest target is entered in today's dollars; the ending estate is
    // nominal at path end, so the target is inflated across the path horizon
    // using this path's *realized* inflation series (mirroring the ledger's
    // cumulative factor, with the plan assumption as the past-series fallback).
    const bequestTarget = pathPlan.expenses.bequestTargetDollars ?? 0
    let pathInflationFactor = 1
    if (bequestTarget > 0) {
      const series = market.inflationPct
      for (let y = 0; y < result.endYear - result.startYear; y++) {
        const pct =
          series && series.length > 0
            ? (series[Math.min(y, series.length - 1)] ?? pathPlan.assumptions.inflationPct)
            : pathPlan.assumptions.inflationPct
        pathInflationFactor *= 1 + pct / 100
      }
    }
    const endingAboveBequestTarget =
      bequestTarget > 0 ? projectionSummary.endingAfterTaxEstate >= bequestTarget * pathInflationFactor : null
    paths.push({
      investableByYear,
      endingInvestable: result.endingInvestable,
      endingNetWorth: result.endingNetWorth,
      endingAfterTaxEstate: projectionSummary.endingAfterTaxEstate,
      depletionYear: result.depletionYear,
      totalShortfall,
      totalRequiredShortfall,
      totalTargetShortfall,
      requiredFloorMet,
      targetLifestyleMet,
      targetAttainmentPct: targetIntended > 0 ? Math.min(1, targetFunded / targetIntended) : 1,
      averageAnnualTargetShortfall: result.years.length > 0 ? targetShortfallTotal / result.years.length : 0,
      yearsBelowTarget,
      idealIntended,
      idealFunded,
      excessIntended,
      excessFunded,
      flexibleGoals,
      guardrailActionCounts,
      guardrailCutYears,
      longestGuardrailCutSpellYears,
      maxGuardrailCutDepth,
      endingAboveBequestTarget,
    })
    opts.onPathDone?.(i + 1)
  }
  return { startYear, endYear, paths }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface YearPercentiles {
  year: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface Histogram {
  min: number
  binWidth: number
  /** counts[i] covers [min + i·binWidth, min + (i+1)·binWidth). */
  counts: number[]
}

export interface MonteCarloSummary {
  pathCount: number
  /** Share of paths whose investable assets never deplete. */
  successRate: number
  /**
   * Share of paths that funded the required spending floor every year
   * (planning-depth roadmap §4). Equals `successRate` unless a guardrail policy
   * or required-floor layer is in play; then it is the more meaningful "never
   * ran short on essentials" number.
   */
  requiredFloorSuccessRate: number
  /** Share of paths that funded full target-lifestyle spending every year. */
  targetLifestyleSuccessRate: number
  /** Path-level target-attainment distribution (1 = every target dollar funded). */
  targetAttainmentPct: Omit<YearPercentiles, 'year'>
  averageAnnualTargetShortfall: number
  p90AverageAnnualTargetShortfall: number
  averageYearsBelowTarget: number
  idealFundingRate: number
  excessFundingRate: number
  flexibleGoals: { funded: number; partiallyFunded: number; deferred: number; skipped: number; fundedAmount: number; unfundedAmount: number }
  guardrailActionCounts: { cut: number; raise: number; hold: number }
  /**
   * Probability-and-magnitude-of-adjustment reporting (risk-based guardrails
   * plan, Kitces 2025 framing): instead of a bare success %, report how likely
   * a mid-course spending adjustment is, how big it tends to be, how long it
   * lasts, and how likely the plan ends with a surplus. Cut metrics are
   * conditional on paths that cut at least once; they are all zero for plans
   * without a guardrail policy.
   */
  adjustments: {
    /** Share of paths with at least one cut year. */
    pathsWithCut: number
    /** Share of paths with at least one raise action. */
    pathsWithRaise: number
    /** Among cut paths: median deepest cut as a fraction of the discretionary layer. */
    medianMaxCutDepth: number
    /** Among cut paths: 90th-percentile deepest cut. */
    p90MaxCutDepth: number
    /** Among cut paths: average number of cut years. */
    averageCutYears: number
    /** Among cut paths: 90th-percentile number of cut years. */
    p90CutYears: number
    /** Among cut paths: average longest consecutive cut spell, in years. */
    averageLongestCutSpellYears: number
    /** Share of paths ending with any after-tax estate left. */
    probEndingSurplus: number
    /** Share of paths whose ending estate clears the bequest target; null = no target set. */
    probEndingAboveBequestTarget: number | null
  }
  downsideRisk: {
    failureRate: number
    failingPathCount: number
    /** Average total unfunded spending across failing paths. */
    expectedShortfallDollars: number
    expectedRequiredShortfallDollars: number
    expectedTargetShortfallDollars: number
    p90TotalShortfallDollars: number
  }
  spendingShortfall: {
    averageTotalShortfallDollars: number
    averageRequiredShortfallDollars: number
    averageTargetShortfallDollars: number
    p90TotalShortfallDollars: number
  }
  /** Per-year investable-balance fan (10/25/50/75/90). */
  fan: YearPercentiles[]
  endingInvestable: { percentiles: Omit<YearPercentiles, 'year'>; histogram: Histogram }
  endingNetWorth: { percentiles: Omit<YearPercentiles, 'year'>; histogram: Histogram }
  endingAfterTaxEstate: { percentiles: Omit<YearPercentiles, 'year'>; histogram: Histogram }
  /** Depletion year → number of paths first depleting that year (successes excluded). */
  depletionYearCounts: { year: number; count: number }[]
  /** Cumulative probability that assets have depleted by each depletion year. */
  depletionProbabilityByYear: { year: number; count: number; probability: number; cumulativeProbability: number }[]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const frac = idx - lo
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac
}

function percentileSet(sorted: number[]): Omit<YearPercentiles, 'year'> {
  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  }
}

function histogramFor(sorted: number[], histogramBins: number): Histogram {
  const min = sorted[0] ?? 0
  const max = sorted[sorted.length - 1] ?? 0
  const binWidth = max > min ? (max - min) / histogramBins : 1
  const counts = new Array<number>(histogramBins).fill(0)
  for (const v of sorted) {
    counts[Math.min(histogramBins - 1, Math.floor((v - min) / binWidth))]!++
  }
  return { min, binWidth, counts }
}

export function aggregateMonteCarlo(result: MonteCarloPathsResult, histogramBins = 30): MonteCarloSummary {
  const { paths, startYear } = result
  const yearCount = paths[0]?.investableByYear.length ?? 0

  const fan: YearPercentiles[] = []
  const column: number[] = new Array(paths.length)
  for (let y = 0; y < yearCount; y++) {
    for (let i = 0; i < paths.length; i++) column[i] = paths[i]!.investableByYear[y]!
    column.sort((a, b) => a - b)
    fan.push({ year: startYear + y, ...percentileSet(column) })
  }

  const endings = paths.map((p) => p.endingInvestable).sort((a, b) => a - b)
  const endingNetWorths = paths.map((p) => p.endingNetWorth).sort((a, b) => a - b)
  const endingAfterTaxEstates = paths.map((p) => p.endingAfterTaxEstate).sort((a, b) => a - b)

  const depletionMap = new Map<number, number>()
  let successes = 0
  let requiredFloorSuccesses = 0
  let targetLifestyleSuccesses = 0
  let averageAnnualTargetShortfallTotal = 0
  let yearsBelowTargetTotal = 0
  let idealIntendedTotal = 0
  let idealFundedTotal = 0
  let excessIntendedTotal = 0
  let excessFundedTotal = 0
  let totalShortfallTotal = 0
  let totalRequiredShortfallTotal = 0
  let totalTargetShortfallTotal = 0
  let failingPathShortfallTotal = 0
  let failingPathRequiredShortfallTotal = 0
  let failingPathTargetShortfallTotal = 0
  let failingPathCount = 0
  const totalShortfalls: number[] = []
  const targetAttainments: number[] = []
  const averageTargetShortfalls: number[] = []
  const flexibleGoals = { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 }
  const guardrailActionCounts = { cut: 0, raise: 0, hold: 0 }
  const cutDepths: number[] = []
  const cutYearCounts: number[] = []
  let cutSpellTotal = 0
  let pathsWithCut = 0
  let pathsWithRaise = 0
  let surplusPaths = 0
  let bequestTargetPaths = 0
  let aboveBequestTargetPaths = 0
  for (const p of paths) {
    if (p.depletionYear === null) successes++
    else {
      depletionMap.set(p.depletionYear, (depletionMap.get(p.depletionYear) ?? 0) + 1)
      failingPathCount++
      failingPathShortfallTotal += p.totalShortfall
      failingPathRequiredShortfallTotal += p.totalRequiredShortfall
      failingPathTargetShortfallTotal += p.totalTargetShortfall
    }
    totalShortfalls.push(p.totalShortfall)
    totalShortfallTotal += p.totalShortfall
    totalRequiredShortfallTotal += p.totalRequiredShortfall
    totalTargetShortfallTotal += p.totalTargetShortfall
    if (p.requiredFloorMet) requiredFloorSuccesses++
    if (p.targetLifestyleMet) targetLifestyleSuccesses++
    targetAttainments.push(p.targetAttainmentPct)
    averageTargetShortfalls.push(p.averageAnnualTargetShortfall)
    averageAnnualTargetShortfallTotal += p.averageAnnualTargetShortfall
    yearsBelowTargetTotal += p.yearsBelowTarget
    idealIntendedTotal += p.idealIntended
    idealFundedTotal += p.idealFunded
    excessIntendedTotal += p.excessIntended
    excessFundedTotal += p.excessFunded
    flexibleGoals.funded += p.flexibleGoals.funded
    flexibleGoals.partiallyFunded += p.flexibleGoals.partiallyFunded
    flexibleGoals.deferred += p.flexibleGoals.deferred
    flexibleGoals.skipped += p.flexibleGoals.skipped
    flexibleGoals.fundedAmount += p.flexibleGoals.fundedAmount
    flexibleGoals.unfundedAmount += p.flexibleGoals.unfundedAmount
    guardrailActionCounts.cut += p.guardrailActionCounts.cut
    guardrailActionCounts.raise += p.guardrailActionCounts.raise
    guardrailActionCounts.hold += p.guardrailActionCounts.hold
    if (p.guardrailCutYears > 0) {
      pathsWithCut++
      cutDepths.push(p.maxGuardrailCutDepth)
      cutYearCounts.push(p.guardrailCutYears)
      cutSpellTotal += p.longestGuardrailCutSpellYears
    }
    if (p.guardrailActionCounts.raise > 0) pathsWithRaise++
    if (p.endingAfterTaxEstate > 0) surplusPaths++
    if (p.endingAboveBequestTarget !== null) {
      bequestTargetPaths++
      if (p.endingAboveBequestTarget) aboveBequestTargetPaths++
    }
  }
  const depletionYearCounts = [...depletionMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year)

  const share = (n: number) => (paths.length === 0 ? 0 : n / paths.length)
  let cumulative = 0
  const depletionProbabilityByYear = depletionYearCounts.map(({ year, count }) => {
    const probability = share(count)
    cumulative += probability
    return { year, count, probability, cumulativeProbability: cumulative }
  })
  targetAttainments.sort((a, b) => a - b)
  averageTargetShortfalls.sort((a, b) => a - b)
  totalShortfalls.sort((a, b) => a - b)
  cutDepths.sort((a, b) => a - b)
  cutYearCounts.sort((a, b) => a - b)
  const adjustments = {
    pathsWithCut: share(pathsWithCut),
    pathsWithRaise: share(pathsWithRaise),
    medianMaxCutDepth: percentile(cutDepths, 50),
    p90MaxCutDepth: percentile(cutDepths, 90),
    averageCutYears: pathsWithCut === 0 ? 0 : cutYearCounts.reduce((a, b) => a + b, 0) / pathsWithCut,
    p90CutYears: percentile(cutYearCounts, 90),
    averageLongestCutSpellYears: pathsWithCut === 0 ? 0 : cutSpellTotal / pathsWithCut,
    probEndingSurplus: share(surplusPaths),
    probEndingAboveBequestTarget: bequestTargetPaths === 0 ? null : aboveBequestTargetPaths / bequestTargetPaths,
  }
  return {
    pathCount: paths.length,
    successRate: share(successes),
    requiredFloorSuccessRate: share(requiredFloorSuccesses),
    targetLifestyleSuccessRate: share(targetLifestyleSuccesses),
    targetAttainmentPct: percentileSet(targetAttainments),
    averageAnnualTargetShortfall: paths.length === 0 ? 0 : averageAnnualTargetShortfallTotal / paths.length,
    p90AverageAnnualTargetShortfall: percentile(averageTargetShortfalls, 90),
    averageYearsBelowTarget: paths.length === 0 ? 0 : yearsBelowTargetTotal / paths.length,
    idealFundingRate: idealIntendedTotal > 0 ? idealFundedTotal / idealIntendedTotal : 1,
    excessFundingRate: excessIntendedTotal > 0 ? excessFundedTotal / excessIntendedTotal : 1,
    flexibleGoals,
    guardrailActionCounts,
    adjustments,
    downsideRisk: {
      failureRate: share(failingPathCount),
      failingPathCount,
      expectedShortfallDollars: failingPathCount === 0 ? 0 : failingPathShortfallTotal / failingPathCount,
      expectedRequiredShortfallDollars:
        failingPathCount === 0 ? 0 : failingPathRequiredShortfallTotal / failingPathCount,
      expectedTargetShortfallDollars: failingPathCount === 0 ? 0 : failingPathTargetShortfallTotal / failingPathCount,
      p90TotalShortfallDollars: percentile(totalShortfalls, 90),
    },
    spendingShortfall: {
      averageTotalShortfallDollars: paths.length === 0 ? 0 : totalShortfallTotal / paths.length,
      averageRequiredShortfallDollars: paths.length === 0 ? 0 : totalRequiredShortfallTotal / paths.length,
      averageTargetShortfallDollars: paths.length === 0 ? 0 : totalTargetShortfallTotal / paths.length,
      p90TotalShortfallDollars: percentile(totalShortfalls, 90),
    },
    fan,
    endingInvestable: { percentiles: percentileSet(endings), histogram: histogramFor(endings, histogramBins) },
    endingNetWorth: { percentiles: percentileSet(endingNetWorths), histogram: histogramFor(endingNetWorths, histogramBins) },
    endingAfterTaxEstate: {
      percentiles: percentileSet(endingAfterTaxEstates),
      histogram: histogramFor(endingAfterTaxEstates, histogramBins),
    },
    depletionYearCounts,
    depletionProbabilityByYear,
  }
}

/** Merge per-worker partial results (path order does not affect aggregation). */
export function mergePathResults(parts: MonteCarloPathsResult[]): MonteCarloPathsResult {
  const nonEmpty = parts.filter((p) => p.paths.length > 0)
  const first = nonEmpty[0] ?? parts[0] ?? { startYear: 0, endYear: 0, paths: [] }
  return { startYear: first.startYear, endYear: first.endYear, paths: nonEmpty.flatMap((p) => p.paths) }
}
